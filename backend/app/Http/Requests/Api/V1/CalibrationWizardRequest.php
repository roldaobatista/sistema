<?php

namespace App\Http\Requests\Api\V1;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CalibrationWizardRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()?->can('manage-calibrations');
    }

    public function rules(): array
    {
        return [
            // Step 1: Equipment
            'equipment_id'         => ['required', 'integer', 'exists:equipment,id'],
            'precision_class'      => ['required', Rule::in(['I', 'II', 'III', 'IIII'])],
            'verification_division_e' => ['required', 'numeric', 'min:0.00001'],
            'max_capacity'         => ['required', 'numeric', 'min:0.001'],
            'capacity_unit'        => ['required', Rule::in(['kg', 'g', 'mg', 't'])],
            'verification_type'    => ['required', Rule::in(['initial', 'subsequent', 'in_use'])],

            // Step 2: Environmental Conditions
            'temperature'          => ['required', 'numeric', 'between:-10,60'],
            'humidity'             => ['required', 'numeric', 'between:0,100'],
            'pressure'             => ['nullable', 'numeric', 'between:800,1200'],
            'calibration_location' => ['required', 'string', 'max:500'],
            'calibration_location_type' => ['required', Rule::in(['laboratory', 'field', 'customer'])],
            'calibration_date'     => ['required', 'date'],
            'received_date'        => ['nullable', 'date'],
            'issued_date'          => ['nullable', 'date'],
            'calibration_method'   => ['required', 'string', 'max:255'],

            // Step 3: Standards
            'standard_used'        => ['required', 'string', 'min:10'],
            'weight_ids'           => ['nullable', 'array'],
            'weight_ids.*'         => ['integer', 'exists:standard_weights,id'],

            // Step 4: Readings
            'readings'             => ['required', 'array', 'min:3'],
            'readings.*.reference_value'        => ['required', 'numeric', 'min:0'],
            'readings.*.indication_increasing'  => ['required', 'numeric'],
            'readings.*.indication_decreasing'  => ['nullable', 'numeric'],
            'readings.*.k_factor'               => ['required', 'numeric', 'min:1', 'max:10'],
            'readings.*.unit'                   => ['nullable', 'string'],

            // Step 5: Eccentricity
            'eccentricity_tests'               => ['required', 'array', 'size:5'],
            'eccentricity_tests.*.position'    => ['required', 'string'],
            'eccentricity_tests.*.load_applied' => ['required', 'numeric', 'min:0'],
            'eccentricity_tests.*.indication'  => ['required', 'numeric'],

            // Step 6: Repeatability
            'repeatability_load'           => ['required', 'numeric', 'min:0'],
            'repeatability_measurements'   => ['required', 'array', 'min:6'],
            'repeatability_measurements.*' => ['required', 'numeric'],
        ];
    }

    public function messages(): array
    {
        return [
            'equipment_id.required'          => 'Equipamento é obrigatório.',
            'precision_class.required'       => 'Classe de exatidão é obrigatória.',
            'verification_division_e.required' => 'Divisão de verificação (e) é obrigatória.',
            'max_capacity.required'          => 'Capacidade máxima é obrigatória.',
            'temperature.required'           => 'Temperatura é obrigatória.',
            'temperature.between'            => 'Temperatura deve estar entre -10°C e 60°C.',
            'humidity.required'              => 'Umidade é obrigatória.',
            'humidity.between'               => 'Umidade deve estar entre 0% e 100%.',
            'calibration_date.required'      => 'Data da calibração é obrigatória.',
            'calibration_method.required'    => 'Método de calibração é obrigatório.',
            'standard_used.required'         => 'Padrão utilizado é obrigatório.',
            'standard_used.min'              => 'Padrão utilizado deve ter pelo menos 10 caracteres.',
            'readings.required'              => 'Leituras são obrigatórias.',
            'readings.min'                   => 'São necessárias ao menos 3 leituras.',
            'eccentricity_tests.required'    => 'Ensaio de excentricidade é obrigatório.',
            'eccentricity_tests.size'        => 'São necessárias exatamente 5 posições de excentricidade.',
            'repeatability_measurements.required' => 'Medições de repetibilidade são obrigatórias.',
            'repeatability_measurements.min' => 'São necessárias ao menos 6 medições de repetibilidade.',
        ];
    }
}
