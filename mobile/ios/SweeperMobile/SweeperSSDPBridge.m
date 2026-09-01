#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SweeperSSDP, NSObject)

RCT_EXTERN_METHOD(
  scan:(nonnull NSNumber *)timeoutMs
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  scanIcmp:(NSString *)localIPv4
  timeoutMs:(nonnull NSNumber *)timeoutMs
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  scanTcpTargets:(NSArray *)targets
  timeoutMs:(nonnull NSNumber *)timeoutMs
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
  exchangeTcp:(NSString *)host
  port:(nonnull NSNumber *)port
  payload:(NSString *)payload
  timeoutMs:(nonnull NSNumber *)timeoutMs
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
