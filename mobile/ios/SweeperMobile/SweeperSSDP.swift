import Foundation
import React
import Darwin
import Network

@objc(SweeperSSDP)
final class SweeperSSDP: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool { false }

  // MARK: ICMP

  @objc(scanIcmp:timeoutMs:resolver:rejecter:)
  func scanIcmp(
    _ localIPv4: String,
    timeoutMs: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .utility).async {
      guard self.validIPv4(localIPv4) else {
        DispatchQueue.main.async {
          reject("icmp_scan_failed", "Invalid local IPv4 address.", nil)
        }
        return
      }

      let ownLast = Int(localIPv4.split(separator: ".").last ?? "") ?? -1
      let prefix = localIPv4.split(separator: ".").dropLast().joined(separator: ".")
      let lock = NSLock()
      var found: [[String: Any]] = []
      let group = DispatchGroup()
      let limiter = DispatchSemaphore(value: 24)
      let queue = DispatchQueue(
        label: "com.sumcoinlabs.sweeper.icmp",
        qos: .utility,
        attributes: .concurrent
      )

      for n in 1...254 where n != ownLast {
        group.enter()
        queue.async {
          limiter.wait()
          defer {
            limiter.signal()
            group.leave()
          }

          let host = "\(prefix).\(n)"
          if let rtt = self.pingOne(
            localIPv4: localIPv4,
            targetIPv4: host,
            timeoutMs: max(1200, timeoutMs.intValue)
          ) {
            lock.lock()
            found.append([
              "ip": host,
              "rttMs": round(rtt * 10) / 10,
            ])
            lock.unlock()
          }
        }
      }

      group.wait()

      found.sort {
        self.lastOctet($0["ip"] as? String ?? "") <
        self.lastOctet($1["ip"] as? String ?? "")
      }

      NSLog("[SWEEPER][NATIVE][ICMP] complete hosts=%d", found.count)
      DispatchQueue.main.async { resolve(found) }
    }
  }

  private func pingOne(
    localIPv4: String,
    targetIPv4: String,
    timeoutMs: Int
  ) -> Double? {
    let perAttemptMs = min(500, max(250, timeoutMs / 3))

    for attempt in 1...3 {
      let fd = Darwin.socket(AF_INET, SOCK_DGRAM, IPPROTO_ICMP)
      if fd < 0 { return nil }
      defer { Darwin.close(fd) }

      var local = sockaddr_in()
      local.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
      local.sin_family = sa_family_t(AF_INET)
      local.sin_port = 0
      guard localIPv4.withCString({
        inet_pton(AF_INET, $0, &local.sin_addr)
      }) == 1 else { return nil }

      let bindResult = withUnsafePointer(to: &local) { ptr in
        ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
          Darwin.bind(
            fd,
            $0,
            socklen_t(MemoryLayout<sockaddr_in>.size)
          )
        }
      }
      if bindResult != 0 { return nil }

      var tv = timeval(tv_sec: 0, tv_usec: Int32(perAttemptMs * 1000))
      _ = withUnsafePointer(to: &tv) {
        setsockopt(
          fd,
          SOL_SOCKET,
          SO_RCVTIMEO,
          $0,
          socklen_t(MemoryLayout<timeval>.size)
        )
      }

      var destination = sockaddr_in()
      destination.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
      destination.sin_family = sa_family_t(AF_INET)
      destination.sin_port = 0
      guard targetIPv4.withCString({
        inet_pton(AF_INET, $0, &destination.sin_addr)
      }) == 1 else { return nil }

      let ident = UInt16.random(in: 1...UInt16.max)
      let seq = UInt16(attempt)
      var packet: [UInt8] = [
        8, 0, 0, 0,
        UInt8(ident >> 8), UInt8(ident & 0xff),
        UInt8(seq >> 8), UInt8(seq & 0xff),
        0x53, 0x57, 0x45, 0x45, 0x50, 0x45, 0x52, 0x32,
      ]
      let checksum = icmpChecksum(packet)
      packet[2] = UInt8(checksum >> 8)
      packet[3] = UInt8(checksum & 0xff)

      let started = Date().timeIntervalSince1970
      let sent = packet.withUnsafeBytes { bytes -> ssize_t in
        guard let base = bytes.baseAddress else { return -1 }
        return withUnsafePointer(to: &destination) { ptr in
          ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            Darwin.sendto(
              fd,
              base,
              packet.count,
              0,
              $0,
              socklen_t(MemoryLayout<sockaddr_in>.size)
            )
          }
        }
      }

      if sent <= 0 {
        usleep(30_000)
        continue
      }

      var source = sockaddr_in()
      var sourceLen = socklen_t(MemoryLayout<sockaddr_in>.size)
      var buffer = [UInt8](repeating: 0, count: 2048)

      let received = buffer.withUnsafeMutableBytes { bytes -> ssize_t in
        guard let base = bytes.baseAddress else { return -1 }
        return withUnsafeMutablePointer(to: &source) { ptr in
          ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            Darwin.recvfrom(
              fd,
              base,
              bytes.count,
              0,
              $0,
              &sourceLen
            )
          }
        }
      }

      if received > 0 {
        var addr = source.sin_addr
        var addressBuffer = [CChar](
          repeating: 0,
          count: Int(INET_ADDRSTRLEN)
        )

        if inet_ntop(
          AF_INET,
          &addr,
          &addressBuffer,
          socklen_t(INET_ADDRSTRLEN)
        ) != nil {
          let sourceIP = String(cString: addressBuffer)
          if sourceIP == targetIPv4 {
            return (Date().timeIntervalSince1970 - started) * 1000
          }
        }
      }

      usleep(30_000)
    }

    return nil
  }

  private func icmpChecksum(_ bytes: [UInt8]) -> UInt16 {
    var sum: UInt32 = 0
    var index = 0

    while index + 1 < bytes.count {
      sum += (UInt32(bytes[index]) << 8) | UInt32(bytes[index + 1])
      index += 2
    }

    if index < bytes.count {
      sum += UInt32(bytes[index]) << 8
    }

    while (sum >> 16) != 0 {
      sum = (sum & 0xffff) + (sum >> 16)
    }

    return ~UInt16(sum & 0xffff)
  }

  // MARK: TCP

  @objc(scanTcpTargets:timeoutMs:resolver:rejecter:)
  func scanTcpTargets(
    _ targets: [String],
    timeoutMs: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .utility).async {
      let lock = NSLock()
      var openTargets: [[String: Any]] = []
      let group = DispatchGroup()
      let limiter = DispatchSemaphore(value: 40)
      let queue = DispatchQueue(
        label: "com.sumcoinlabs.sweeper.tcp",
        qos: .utility,
        attributes: .concurrent
      )

      for target in targets {
        let bits = target.split(separator: ":", maxSplits: 1)
        guard bits.count == 2, let port = UInt16(bits[1]) else { continue }
        let host = String(bits[0])

        group.enter()
        queue.async {
          limiter.wait()
          defer {
            limiter.signal()
            group.leave()
          }

          if self.tcpOpen(
            host: host,
            port: port,
            timeoutMs: max(250, timeoutMs.intValue)
          ) {
            lock.lock()
            openTargets.append(["ip": host, "port": Int(port)])
            lock.unlock()
          }
        }
      }

      group.wait()
      NSLog(
        "[SWEEPER][NATIVE][TCP] complete targets=%d open=%d",
        targets.count,
        openTargets.count
      )
      DispatchQueue.main.async { resolve(openTargets) }
    }
  }

  private func tcpOpen(
    host: String,
    port: UInt16,
    timeoutMs: Int
  ) -> Bool {
    guard let nwPort = NWEndpoint.Port(rawValue: port) else { return false }

    let connection = NWConnection(
      host: NWEndpoint.Host(host),
      port: nwPort,
      using: .tcp
    )

    let semaphore = DispatchSemaphore(value: 0)
    let lock = NSLock()
    var settled = false
    var isOpen = false

    func finish(_ value: Bool) {
      lock.lock()
      defer { lock.unlock() }
      if settled { return }
      settled = true
      isOpen = value
      semaphore.signal()
    }

    connection.stateUpdateHandler = { state in
      switch state {
      case .ready:
        finish(true)
      case .failed, .cancelled:
        finish(false)
      default:
        break
      }
    }

    connection.start(
      queue: DispatchQueue(
        label: "com.sumcoinlabs.sweeper.tcp.\(host).\(port)"
      )
    )

    if semaphore.wait(
      timeout: .now() + .milliseconds(timeoutMs)
    ) == .timedOut {
      finish(false)
    }

    connection.cancel()
    return isOpen
  }

  @objc(exchangeTcp:port:payload:timeoutMs:resolver:rejecter:)
  func exchangeTcp(
    _ host: String,
    port: NSNumber,
    payload: String,
    timeoutMs: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .utility).async {
      let value = self.tcpExchange(
        host: host,
        port: UInt16(truncating: port),
        payload: payload,
        timeoutMs: max(500, timeoutMs.intValue)
      )
      DispatchQueue.main.async { resolve(value) }
    }
  }

  private func tcpExchange(
    host: String,
    port: UInt16,
    payload: String,
    timeoutMs: Int
  ) -> String {
    guard let nwPort = NWEndpoint.Port(rawValue: port) else { return "" }

    let connection = NWConnection(
      host: NWEndpoint.Host(host),
      port: nwPort,
      using: .tcp
    )

    let semaphore = DispatchSemaphore(value: 0)
    let lock = NSLock()
    var settled = false
    var output = ""

    func finish(_ value: String) {
      lock.lock()
      defer { lock.unlock() }
      if settled { return }
      settled = true
      output = value
      semaphore.signal()
    }

    connection.stateUpdateHandler = { state in
      switch state {
      case .ready:
        let data = payload.data(using: .utf8) ?? Data()
        connection.send(
          content: data,
          completion: .contentProcessed { error in
            if error != nil {
              finish("")
              return
            }

            connection.receive(
              minimumIncompleteLength: 1,
              maximumLength: 8192
            ) { data, _, _, _ in
              guard let data else {
                finish("")
                return
              }
              finish(String(data: data, encoding: .utf8) ?? "")
            }
          }
        )

      case .failed, .cancelled:
        finish("")

      default:
        break
      }
    }

    connection.start(
      queue: DispatchQueue(
        label: "com.sumcoinlabs.sweeper.exchange.\(host).\(port)"
      )
    )

    if semaphore.wait(
      timeout: .now() + .milliseconds(timeoutMs)
    ) == .timedOut {
      finish("")
    }

    connection.cancel()
    return output
  }

  // MARK: SSDP

  @objc(scan:resolver:rejecter:)
  func scan(
    _ timeoutMs: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .utility).async {
      do {
        let results = try self.performSsdpScan(
          timeoutMs: max(1000, timeoutMs.intValue)
        )
        DispatchQueue.main.async { resolve(results) }
      } catch {
        DispatchQueue.main.async {
          reject("ssdp_scan_failed", error.localizedDescription, error)
        }
      }
    }
  }

  private enum SsdpScanError: LocalizedError {
    case socketCreation
    case bind
    case destination
    case send

    var errorDescription: String? {
      switch self {
      case .socketCreation:
        return "Could not create the UDP discovery socket."
      case .bind:
        return "Could not bind the UDP discovery socket."
      case .destination:
        return "Could not configure the SSDP multicast destination."
      case .send:
        return "Could not send the SSDP discovery request."
      }
    }
  }

  private func performSsdpScan(timeoutMs: Int) throws -> [[String: String]] {
    let fd = Darwin.socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
    guard fd >= 0 else { throw SsdpScanError.socketCreation }
    defer { Darwin.close(fd) }

    var reuse: Int32 = 1
    _ = withUnsafePointer(to: &reuse) {
      setsockopt(
        fd,
        SOL_SOCKET,
        SO_REUSEADDR,
        $0,
        socklen_t(MemoryLayout<Int32>.size)
      )
    }

    var local = sockaddr_in()
    local.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    local.sin_family = sa_family_t(AF_INET)
    local.sin_port = in_port_t(0)
    local.sin_addr = in_addr(s_addr: in_addr_t(INADDR_ANY))

    let bindResult = withUnsafePointer(to: &local) { ptr in
      ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
        Darwin.bind(
          fd,
          $0,
          socklen_t(MemoryLayout<sockaddr_in>.size)
        )
      }
    }
    guard bindResult == 0 else { throw SsdpScanError.bind }

    var receiveTimeout = timeval(tv_sec: 0, tv_usec: 200_000)
    _ = withUnsafePointer(to: &receiveTimeout) {
      setsockopt(
        fd,
        SOL_SOCKET,
        SO_RCVTIMEO,
        $0,
        socklen_t(MemoryLayout<timeval>.size)
      )
    }

    var destination = sockaddr_in()
    destination.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
    destination.sin_family = sa_family_t(AF_INET)
    destination.sin_port = in_port_t(1900).bigEndian

    guard "239.255.255.250".withCString({
      inet_pton(AF_INET, $0, &destination.sin_addr)
    }) == 1 else {
      throw SsdpScanError.destination
    }

    let request =
      "M-SEARCH * HTTP/1.1\r\n" +
      "HOST: 239.255.255.250:1900\r\n" +
      "MAN: \"ssdp:discover\"\r\n" +
      "MX: 2\r\n" +
      "ST: ssdp:all\r\n" +
      "USER-AGENT: Sweeper/0.1 iOS\r\n\r\n"

    guard let requestData = request.data(using: .utf8) else {
      throw SsdpScanError.send
    }

    func sendSearch() -> Bool {
      let sent = requestData.withUnsafeBytes { bytes -> ssize_t in
        guard let base = bytes.baseAddress else { return -1 }
        return withUnsafePointer(to: &destination) { ptr in
          ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            Darwin.sendto(
              fd,
              base,
              requestData.count,
              0,
              $0,
              socklen_t(MemoryLayout<sockaddr_in>.size)
            )
          }
        }
      }
      return sent == requestData.count
    }

    guard sendSearch() else { throw SsdpScanError.send }
    usleep(150_000)
    _ = sendSearch()

    let deadline = Date().addingTimeInterval(Double(timeoutMs) / 1000)
    var results: [[String: String]] = []
    var seen = Set<String>()
    var buffer = [UInt8](repeating: 0, count: 65_535)

    while Date() < deadline {
      var source = sockaddr_in()
      var sourceLen = socklen_t(MemoryLayout<sockaddr_in>.size)

      let received = buffer.withUnsafeMutableBytes { bytes -> ssize_t in
        guard let base = bytes.baseAddress else { return -1 }
        return withUnsafeMutablePointer(to: &source) { ptr in
          ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) {
            Darwin.recvfrom(
              fd,
              base,
              bytes.count,
              0,
              $0,
              &sourceLen
            )
          }
        }
      }

      if received <= 0 { continue }

      guard let response = String(
        data: Data(buffer[0..<Int(received)]),
        encoding: .utf8
      ) else { continue }

      var address = source.sin_addr
      var addressBuffer = [CChar](
        repeating: 0,
        count: Int(INET_ADDRSTRLEN)
      )

      let converted = inet_ntop(
        AF_INET,
        &address,
        &addressBuffer,
        socklen_t(INET_ADDRSTRLEN)
      )

      let sourceIP = converted == nil ? "" : String(cString: addressBuffer)
      let parsed = parseSsdpResponse(response, sourceIP: sourceIP)
      let key = [
        parsed["ip"] ?? "",
        parsed["usn"] ?? "",
        parsed["st"] ?? "",
        parsed["location"] ?? "",
      ].joined(separator: "|")

      if !seen.contains(key) {
        seen.insert(key)
        results.append(parsed)
      }
    }

    return results
  }

  private func parseSsdpResponse(
    _ response: String,
    sourceIP: String
  ) -> [String: String] {
    var result: [String: String] = ["ip": sourceIP]

    for line in response.components(separatedBy: "\r\n") {
      guard let colon = line.firstIndex(of: ":") else { continue }

      let key = String(line[..<colon])
        .trimmingCharacters(in: .whitespacesAndNewlines)
        .lowercased()

      let value = String(line[line.index(after: colon)...])
        .trimmingCharacters(in: .whitespacesAndNewlines)

      switch key {
      case "st":
        result["st"] = value
      case "usn":
        result["usn"] = value
      case "location":
        result["location"] = value
      case "server":
        result["server"] = value
      case "cache-control":
        result["cacheControl"] = value
      default:
        break
      }
    }

    return result
  }

  private func lastOctet(_ ip: String) -> Int {
    Int(ip.split(separator: ".").last ?? "") ?? 0
  }

  private func validIPv4(_ ip: String) -> Bool {
    let parts = ip.split(separator: ".")
    return parts.count == 4 && parts.allSatisfy {
      guard let n = Int($0) else { return false }
      return n >= 0 && n <= 255
    }
  }
}
