# Milestone 2B - SSDP / UPnP Discovery

Status: FOUNDATION IMPLEMENTED - PHYSICAL IOS MULTICAST VALIDATION PENDING

## Implemented

- Native iOS UDP SSDP discovery module
- React Native bridge for SSDP scanning
- SSDP / UPnP M-SEARCH support
- SSDP metadata collection:
  - IP address
  - service/device type
  - USN
  - server string
  - device-description location
- TCP + Bonjour/mDNS + SSDP result merging
- SSDP camera/security fingerprint hints
- Backend persistence of SSDP discovery metadata
- Matching frontend/backend risk handling
- Structured Wi-Fi diagnostic logging
- Improved network-device presentation

## Physical-device finding

Bonjour/mDNS was successfully validated on a physical iPhone.

SSDP produced no useful discovery results on the current test network.
Independent Mac testing also produced zero SSDP responses from this network.

On iOS, general multicast UDP access may additionally require Apple's
multicast networking entitlement. Therefore SSDP remains implemented but is
not considered a universally available iOS discovery method until capability
testing is completed.

## Ground-truth network findings

Testing showed that relying only on Bonjour and selected TCP ports is not
sufficient.

The local test network has approximately 15-17 active hosts depending on the
moment of the scan.

Several devices expose no useful TCP service on the original Sweeper port set.

At least one device at 192.168.1.226 exposes RTSP on TCP 554 and responds to a
standards-compliant RTSP OPTIONS request.

Multiple otherwise quiet network devices respond to ICMP.

These findings establish the requirements for Milestone 2C:

- native host discovery independent of advertised application services
- ICMP-assisted discovery
- broader targeted TCP discovery
- RTSP protocol fingerprinting
- HTTP service fingerprinting
- device evidence merging and classification
- no camera-risk score merely because a host exists
