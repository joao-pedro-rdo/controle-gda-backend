declare module "bcrypt" {
  export function genSaltSync(rounds: number): string;
  export function hash(
    data: string,
    salt: string,
    callback: (err: Error | undefined, encrypted: string) => void
  ): void;
  export function compare(
    data: string,
    encrypted: string,
    callback: (err: Error | undefined, same: boolean) => void
  ): void;
}
