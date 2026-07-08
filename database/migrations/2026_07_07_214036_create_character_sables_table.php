<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('character_sables', function (Blueprint $table) {
            $table->id();
            $table->foreignId('character_id')->constrained('characters')->cascadeOnDelete();
            $table->string('nombre')->default('Sable');
            $table->boolean('activo')->default(false);

            foreach (['nucleo', 'cristal', 'lente', 'emisor', 'estabilizador', 'empunadura', 'modulo', 'accesorio'] as $slot) {
                $table->foreignId("{$slot}_id")->nullable()->constrained('rol_objetos')->nullOnDelete();
            }

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('character_sables');
    }
};
