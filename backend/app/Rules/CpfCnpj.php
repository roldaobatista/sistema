<?php

namespace App\Rules;

use Closure;
use Illuminate\Contracts\Validation\ValidationRule;

class CpfCnpj implements ValidationRule
{
    /**
     * Run the validation rule.
     *
     * @param  \Closure(string, ?string=): \Illuminate\Translation\PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $value = preg_replace('/[^0-9]/', '', (string) $value);
        $len = strlen($value);

        if ($len === 11) {
            if (!$this->validateCpf($value)) {
                $fail('O CPF informado é inválido.');
            }
        } elseif ($len === 14) {
            if (!$this->validateCnpj($value)) {
                $fail('O CNPJ informado é inválido.');
            }
        } else {
            $fail('O documento deve ser um CPF ou CNPJ válido.');
        }
    }

    private function validateCpf(string $cpf): bool
    {
        if (preg_match('/(\d)\1{10}/', $cpf)) return false;

        for ($t = 9; $t < 11; $t++) {
            for ($d = 0, $c = 0; $c < $t; $c++) {
                $d += $cpf[$c] * (($t + 1) - $c);
            }
            $d = ((10 * $d) % 11) % 10;
            if ($cpf[$c] != $d) return false;
        }
        return true;
    }

    private function validateCnpj(string $cnpj): bool
    {
        if (preg_match('/(\d)\1{13}/', $cnpj)) return false;

        $tamanho = strlen($cnpj) - 2;
        $numeros = substr($cnpj, 0, $tamanho);
        $digitos = substr($cnpj, $tamanho);
        $soma = 0;
        $pos = $tamanho - 7;

        for ($i = $tamanho; $i >= 1; $i--) {
            $soma += $numeros[$tamanho - $i] * $pos--;
            if ($pos < 2) $pos = 9;
        }

        $resultado = $soma % 11 < 2 ? 0 : 11 - ($soma % 11);
        if ($resultado != $digitos[0]) return false;

        $tamanho = $tamanho + 1;
        $numeros = substr($cnpj, 0, $tamanho);
        $soma = 0;
        $pos = $tamanho - 7;
        for ($i = $tamanho; $i >= 1; $i--) {
            $soma += $numeros[$tamanho - $i] * $pos--;
            if ($pos < 2) $pos = 9;
        }

        $resultado = $soma % 11 < 2 ? 0 : 11 - ($soma % 11);
        return $resultado == $digitos[1];
    }
}
