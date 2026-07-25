<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dungeon_sala_progresos', function (Blueprint $table) {
            $table->boolean('cofre_abierto')->default(false)->after('resuelta');
        });
    }

    public function down(): void
    {
        Schema::table('dungeon_sala_progresos', function (Blueprint $table) {
            $table->dropColumn('cofre_abierto');
        });
    }
};
