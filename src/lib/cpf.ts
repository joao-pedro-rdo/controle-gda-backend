export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function isValidCpf(value: string): boolean {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11) return false;

  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const verifyDigit = (baseLength: number): boolean => {
    let sum = 0;
    for (let i = 0; i < baseLength; i++) {
      sum += Number(cpf[i]) * (baseLength + 1 - i);
    }
    let rest = sum % 11;
    if (rest < 2) rest = 0;
    else rest = 11 - rest;
    return rest === Number(cpf[baseLength]);
  };

  return verifyDigit(9) && verifyDigit(10);
}
