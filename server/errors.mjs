export class DomainError extends Error {
  constructor(code, status = 400) { super(code); this.status = status; }
}
