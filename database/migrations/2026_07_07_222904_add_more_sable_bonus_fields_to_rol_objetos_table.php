<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->integer('bono_iniciativa')->nullable()->after('bono_movimiento');
            $table->integer('bono_vida')->nullable()->after('bono_iniciativa');
            $table->integer('bono_escudo')->nullable()->after('bono_vida');
        });
    }

    public function down(): void
    {
        Schema::table('rol_objetos', function (Blueprint $table) {
            $table->dropColumn(['bono_iniciativa', 'bono_vida', 'bono_escudo']);
        });
    }
};
