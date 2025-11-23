export class InsufficientBalanceError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InsufficientBalanceError'
  }
}

export class DeductionInProgressError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DeductionInProgressError'
  }
}

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatabaseError'
  }
}

export class MaxRetriesExceededError extends Error {
  public readonly originalError: Error

  constructor(message: string, originalError: Error) {
    super(message)
    this.name = 'MaxRetriesExceededError'
    this.originalError = originalError
  }
}
