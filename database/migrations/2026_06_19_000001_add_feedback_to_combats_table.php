<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('combats', function (Blueprint $table) {
            $table->text('feedback_a')->nullable()->after('score_data');
            $table->text('feedback_b')->nullable()->after('feedback_a');
        });
    }

    public function down(): void
    {
        Schema::table('combats', function (Blueprint $table) {
            $table->dropColumn(['feedback_a', 'feedback_b']);
        });
    }
};
