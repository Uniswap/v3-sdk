/**
 * Generated method parameters for executing a call.
 */
export interface MethodParameters {
  /**
   * The method to call on the given address.
   */
  methodName: string
  /**
   * The arguments to pass to the method, all hex encoded.
   */
  args: (string | string[])[]
  /**
   * The amount of ether (wei) to send in hex.
   */
  value: string
}
