<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('recompensas', function (Blueprint $table) {
            $table->foreignId('objeto_id')->nullable()->after('habilidad_id')
                  ->constrained('rol_objetos')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('recompensas', function (Blueprint $table) {
            $table->dropForeign(['objeto_id']);
            $table->dropColumn('objeto_id');
        });
    }
};
