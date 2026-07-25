<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->enum('tipo_interaccion', ['interaccion', 'agente_ia', 'interaccion_ia'])
                ->default('interaccion')
                ->after('interaccion_generada_at');
        });

        // Backfill: preserva el comportamiento previo, donde `prompt` (si tenía contenido)
        // activaba el chat en vivo por encima de todo, y `prompt_respuestas` activaba
        // la generación de interacción si no había chat en vivo.
        DB::table('map_npcs')
            ->whereNotNull('prompt')->where('prompt', '!=', '')
            ->update(['tipo_interaccion' => 'agente_ia']);

        DB::table('map_npcs')
            ->where(fn ($q) => $q->whereNull('prompt')->orWhere('prompt', ''))
            ->whereNotNull('prompt_respuestas')->where('prompt_respuestas', '!=', '')
            ->update(['tipo_interaccion' => 'interaccion_ia']);
    }

    public function down(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->dropColumn('tipo_interaccion');
        });
    }
};
