#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(SweeperSSDP, NSObject)

RCT_EXTERN_METHOD(
  scan:(nonnull NSNumber *)timeoutMs
  resolver:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject
)

@end
