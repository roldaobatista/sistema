<?php

namespace App\Exceptions;

use App\Models\WorkOrder;
use Exception;

class QuoteAlreadyConvertedException extends Exception
{
    public function __construct(
        public readonly WorkOrder $workOrder,
        string $message = "Este orcamento ja foi convertido em OS",
        int $code = 409
    ) {
        parent::__construct($message, $code);
    }
}
