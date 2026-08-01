<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reemplazados por el sistema de recompensas estructuradas (evento_recompensas),
 * el mismo mecanismo que ya usan las Misiones — `reward_badge` era solo texto
 * decorativo sin efecto real, y `reward` un entero de créditos separado del
 * resto de recompensas.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropColumn(['reward', 'reward_badge']);
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->integer('reward')->default(0)->after('location');
            $table->string('reward_badge')->nullable()->after('reward');
        });
    }
};
