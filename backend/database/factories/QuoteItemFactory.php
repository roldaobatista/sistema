<?php

namespace Database\Factories;

use App\Models\Product;
use App\Models\Quote;
use App\Models\QuoteEquipment;
use App\Models\QuoteItem;
use App\Models\Service;
use Illuminate\Database\Eloquent\Factories\Factory;

class QuoteItemFactory extends Factory
{
    protected $model = QuoteItem::class;

    public function definition(): array
    {
        // Randomly decide if product or service
        $isProduct = fake()->boolean();
        $type = $isProduct ? 'product' : 'service';

        // Check if there is a QuoteEquipment. If not, create one.
        // But QuoteEquipment creates a Quote.
        // So we can just create QuoteEquipment.
        
        return [
            'tenant_id' => \App\Models\Tenant::factory(),
            'quote_equipment_id' => QuoteEquipment::factory(), // This handles quote connection
            'type' => $type,
            'product_id' => $isProduct ? Product::factory() : null,
            'service_id' => !$isProduct ? Service::factory() : null,
            'custom_description' => fake()->sentence(),
            'quantity' => fake()->randomFloat(2, 1, 100),
            'original_price' => fake()->randomFloat(2, 10, 500),
            'unit_price' => fake()->randomFloat(2, 10, 500),
            'discount_percentage' => 0,
            'subtotal' => function (array $attributes) {
                 return $attributes['quantity'] * $attributes['unit_price'];
            },
            'sort_order' => fake()->numberBetween(0, 100),
        ];
    }
}
