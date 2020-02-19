export class InsufficientReservesError extends Error {
  public constructor() {
    super()
    this.name = this.constructor.name
  }
}

export class InsufficientInputAmountError extends Error {
  public constructor() {
    super()
    this.name = this.constructor.name
  }
}
