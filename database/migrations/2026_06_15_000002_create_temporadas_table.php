<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('temporadas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre', 100);
            $table->text('descripcion')->nullable();
            $table->string('foto_emblema')->nullable();
            $table->date('periodo_inicio');
            $table->date('periodo_fin');
            $table->foreignId('primer_lugar_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('segundo_lugar_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('tercer_lugar_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('temporadas');
    }
};
