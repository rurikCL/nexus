<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->text('prompt_respuestas')->nullable()->after('prompt');
            $table->timestamp('interaccion_generada_at')->nullable()->after('prompt_respuestas');
        });
    }

    public function down(): void
    {
        Schema::table('map_npcs', function (Blueprint $table) {
            $table->dropColumn(['prompt_respuestas', 'interaccion_generada_at']);
        });
    }
};
