<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Añadir tutor_id a users antes de eliminar la tabla pivot
        Schema::table('users', function (Blueprint $table) {
            $table->foreignId('tutor_id')
                ->nullable()
                ->after('tier')
                ->constrained('users')
                ->nullOnDelete();
        });

        // Migrar datos existentes de la tabla pivot
        if (Schema::hasTable('tutor_pupil')) {
            DB::table('tutor_pupil')->orderBy('tutor_id')->each(function ($row) {
                DB::table('users')
                    ->where('id', $row->pupil_id)
                    ->update(['tutor_id' => $row->tutor_id]);
            });

            Schema::dropIfExists('tutor_pupil');
        }
    }

    public function down(): void
    {
        Schema::create('tutor_pupil', function (Blueprint $table) {
            $table->foreignId('tutor_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('pupil_id')->constrained('users')->cascadeOnDelete();
            $table->primary(['tutor_id', 'pupil_id']);
        });

        // Restaurar datos a la tabla pivot
        DB::table('users')->whereNotNull('tutor_id')->each(function ($user) {
            DB::table('tutor_pupil')->insertOrIgnore([
                'tutor_id' => $user->tutor_id,
                'pupil_id' => $user->id,
            ]);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['tutor_id']);
            $table->dropColumn('tutor_id');
        });
    }
};
