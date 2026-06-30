<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rol_habilidades', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->enum('tipo', ['melee', 'distancia']);
            $table->unsignedTinyInteger('forma')->default(0)->comment('0 al 7');
            $table->unsignedSmallInteger('costo_fuerza')->default(0);
            $table->text('efecto')->nullable();
            $table->unsignedSmallInteger('damage')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rol_habilidades');
    }
};
