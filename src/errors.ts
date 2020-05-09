// see https://stackoverflow.com/a/41102306
const CAN_SET_PROTOTYPE = 'setPrototypeOf' in Object

export class InsufficientReservesError extends Error {
  public readonly isInsufficientReservesError: true = true

  public constructor() {
    super()
    this.name = this.constructor.name
    if (CAN_SET_PROTOTYPE) Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class InsufficientInputAmountError extends Error {
  public readonly isInsufficientInputAmountError: true = true

  public constructor() {
    super()
    this.name = this.constructor.name
    if (CAN_SET_PROTOTYPE) Object.setPrototypeOf(this, new.target.prototype)
  }
}
