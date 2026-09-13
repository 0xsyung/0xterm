/**
 * @file index.ts
 * @description Dig workshop public exports (#39/#40)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
export * from "./constants";
export * from "./pragma";
export * from "./version";
export * from "./artifact";
export * from "./opcodes";
export * from "./idb";
export * from "./templates";
export * from "./args";
export * from "./encode";
export * from "./gas";
export * from "./session";
export { compileDigSource, ensureSolcLoaded } from "./solc";
export type { DigCompileResult } from "./solc";
export {
  digVmHardforkLabel,
  digVmTestAccount,
  resetDigVm,
  vmCall,
  vmDeploy
} from "./vm";
