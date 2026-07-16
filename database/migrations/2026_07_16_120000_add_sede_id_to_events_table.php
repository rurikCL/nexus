<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Un evento puede ser propio de una sede (torneo/exhibición local) o quedar sin
 * sede (evento general, visible para todas). Nullable a propósito: no se fuerza
 * a elegir sede al crear un evento.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->foreignId('sede_id')->nullable()->after('location')->constrained('sedes')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('events', function (Blueprint $table) {
            $table->dropConstrainedForeignId('sede_id');
        });
    }
};
