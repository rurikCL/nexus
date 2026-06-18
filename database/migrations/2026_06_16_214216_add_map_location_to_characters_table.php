<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->foreignId('map_sistema_id')->nullable()->constrained('map_sistemas')->nullOnDelete();
            $table->foreignId('map_planeta_id')->nullable()->constrained('map_planetas')->nullOnDelete();
            $table->foreignId('map_zona_id')->nullable()->constrained('map_zonas')->nullOnDelete();
            $table->foreignId('map_lugar_id')->nullable()->constrained('map_lugares')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('characters', function (Blueprint $table) {
            $table->dropForeign(['map_sistema_id']);
            $table->dropForeign(['map_planeta_id']);
            $table->dropForeign(['map_zona_id']);
            $table->dropForeign(['map_lugar_id']);
            $table->dropColumn(['map_sistema_id', 'map_planeta_id', 'map_zona_id', 'map_lugar_id']);
        });
    }
};
