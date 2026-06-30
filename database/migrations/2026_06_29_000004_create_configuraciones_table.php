<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('configuraciones', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 100)->unique();
            $table->string('tipo_valor', 20)->default('numerico'); // numerico | texto
            $table->decimal('valor_numerico', 10, 2)->nullable();
            $table->text('valor_texto')->nullable();
            $table->boolean('activo')->default(true);
            $table->timestamps();
        });

        $now = now();
        DB::table('configuraciones')->insert([
            ['nombre' => 'limite_respuestas',  'tipo_valor' => 'numerico', 'valor_numerico' => 15,  'valor_texto' => null, 'activo' => true, 'created_at' => $now, 'updated_at' => $now],
            ['nombre' => 'ventana_tiempo',     'tipo_valor' => 'numerico', 'valor_numerico' => 5,   'valor_texto' => null, 'activo' => true, 'created_at' => $now, 'updated_at' => $now],
            ['nombre' => 'historial_max',      'tipo_valor' => 'numerico', 'valor_numerico' => 8,   'valor_texto' => null, 'activo' => true, 'created_at' => $now, 'updated_at' => $now],
            ['nombre' => 'tokens_max',         'tipo_valor' => 'numerico', 'valor_numerico' => 220, 'valor_texto' => null, 'activo' => true, 'created_at' => $now, 'updated_at' => $now],
            ['nombre' => 'umbral_conversacion','tipo_valor' => 'numerico', 'valor_numerico' => 15,  'valor_texto' => null, 'activo' => true, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('configuraciones');
    }
};
