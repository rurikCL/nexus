<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('training_plan_nodes', function (Blueprint $table) {
            $table->boolean('es_adicional')->default(false)->after('orden');
            $table->foreignId('created_by')->nullable()->after('es_adicional')
                  ->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('training_plan_nodes', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn(['created_by', 'es_adicional']);
        });
    }
};
