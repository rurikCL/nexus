<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('tutor_pupil', function (Blueprint $table) {
            $table->foreignId('tutor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('pupil_id')->constrained('users')->cascadeOnDelete();

            $table->primary(['tutor_id', 'pupil_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tutor_pupil');
    }
};
