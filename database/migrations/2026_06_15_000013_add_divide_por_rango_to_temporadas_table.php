<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('temporadas', function (Blueprint $table) {
            $table->boolean('divide_por_rango')->default(false)->after('foto_emblema');
        });
    }

    public function down(): void
    {
        Schema::table('temporadas', function (Blueprint $table) {
            $table->dropColumn('divide_por_rango');
        });
    }
};
