import Foundation
import React
import Darwin

@objc(SweeperSSDP)
final class SweeperSSDP: NSObject {
  @objc static func requiresMainQueueSetup() -> Bool {
    false
  }

  @objc(scan:resolver:rejecter:)
  func scan(
    _ timeoutMs: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.global(qos: .utility).async {
      do {
        let results = try self.performScan(timeoutMs: max(1000, timeoutMs.intValue))
        DispatchQueue.main.async {
          resolve(results)
        }
      } catch {
        DispatchQueue.main.async {
          reject("ssdp_scan_failed", error.localizedDescription, error)
        }
      }
    }
  }

  private enum ScanError: LocalizedError {
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

  private func performScan(timeoutMs: Int) throws -> [[String: String]] {
    let fd = Darwin.socket(AF_INET, SOCK_DGRAM, IPPROTO_UDP)
    guard fd >= 0 else {
      throw ScanError.socketCreation
    }
    defer {
      Darwin.close(fd)
    }

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
      ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { socketAddress in
        Darwin.bind(
          fd,
          socketAddress,
          socklen_t(MemoryLayout<sockaddr_in>.size)
        )
      }
    }

    guard bindResult == 0 else {
      throw ScanError.bind
    }

    // Short receive timeout lets us keep checking the overall scan deadline.
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

    let conversion = "239.255.255.250".withCString {
      inet_pton(AF_INET, $0, &destination.sin_addr)
    }

    guard conversion == 1 else {
      throw ScanError.destination
    }

    let request =
      "M-SEARCH * HTTP/1.1\r\n" +
      "HOST: 239.255.255.250:1900\r\n" +
      "MAN: \"ssdp:discover\"\r\n" +
      "MX: 2\r\n" +
      "ST: ssdp:all\r\n" +
      "USER-AGENT: Sweeper/0.1 iOS\r\n" +
      "\r\n"

    guard let requestData = request.data(using: .utf8) else {
      throw ScanError.send
    }

    func sendSearch() -> Bool {
      let sent = requestData.withUnsafeBytes { bytes -> ssize_t in
        guard let baseAddress = bytes.baseAddress else {
          return -1
        }

        return withUnsafePointer(to: &destination) { ptr in
          ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { socketAddress in
            Darwin.sendto(
              fd,
              baseAddress,
              requestData.count,
              0,
              socketAddress,
              socklen_t(MemoryLayout<sockaddr_in>.size)
            )
          }
        }
      }

      return sent == requestData.count
    }

    guard sendSearch() else {
      throw ScanError.send
    }

    // A second M-SEARCH improves discovery reliability on busy consumer LANs.
    usleep(150_000)
    _ = sendSearch()

    let deadline = Date().addingTimeInterval(Double(timeoutMs) / 1000.0)
    var results: [[String: String]] = []
    var seen = Set<String>()
    var buffer = [UInt8](repeating: 0, count: 65_535)

    while Date() < deadline {
      var source = sockaddr_in()
      var sourceLength = socklen_t(MemoryLayout<sockaddr_in>.size)

      let received = buffer.withUnsafeMutableBytes { bytes -> ssize_t in
        guard let baseAddress = bytes.baseAddress else {
          return -1
        }

        return withUnsafeMutablePointer(to: &source) { ptr in
          ptr.withMemoryRebound(to: sockaddr.self, capacity: 1) { socketAddress in
            Darwin.recvfrom(
              fd,
              baseAddress,
              bytes.count,
              0,
              socketAddress,
              &sourceLength
            )
          }
        }
      }

      if received <= 0 {
        continue
      }

      guard
        let response = String(
          data: Data(buffer[0..<Int(received)]),
          encoding: .utf8
        )
      else {
        continue
      }

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
      let parsed = parseResponse(response, sourceIP: sourceIP)

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

  private func parseResponse(
    _ response: String,
    sourceIP: String
  ) -> [String: String] {
    var result: [String: String] = [
      "ip": sourceIP,
    ]

    for line in response.components(separatedBy: "\r\n") {
      guard let colon = line.firstIndex(of: ":") else {
        continue
      }

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
}
