export class AppError extends Error {
  private _innerError: Error;

  public get innerError() {
    return this._innerError;
  }

  public constructor(message: string, innerError: Error) {
    super(message);
    this.name = "AppError";
    this._innerError = innerError;
  }

  toString() {
    return `${this.name}: ${
      this.message
    }\nCaused by: ${this.innerError.toString()}`;
  }
}
