<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('map_naves', function (Blueprint $table) {
            $table->integer('costo_combustible')->default(0)->after('costo_reparacion');
        });
    }

    public function down(): void
    {
        Schema::table('map_naves', function (Blueprint $table) {
            $table->dropColumn('costo_combustible');
        });
    }
};
