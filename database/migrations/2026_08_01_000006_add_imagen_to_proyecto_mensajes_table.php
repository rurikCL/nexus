<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('proyecto_mensajes', function (Blueprint $table) {
            $table->string('imagen')->nullable()->after('mensaje');
        });
    }

    public function down(): void
    {
        Schema::table('proyecto_mensajes', function (Blueprint $table) {
            $table->dropColumn('imagen');
        });
    }
};
