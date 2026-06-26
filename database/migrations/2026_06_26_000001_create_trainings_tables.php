<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('trainings', function (Blueprint $table) {
            $table->id();
            $table->string('titulo');
            $table->date('fecha');
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('closed_at')->nullable();
            $table->foreignId('closed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('training_encargados', function (Blueprint $table) {
            $table->foreignId('training_id')->constrained('trainings')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->primary(['training_id', 'user_id']);
        });

        Schema::create('training_plan_nodes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('training_id')->constrained('trainings')->cascadeOnDelete();
            $table->enum('type', ['module', 'text'])->default('text');
            $table->foreignId('modulo_id')->nullable()->constrained('modulos_entrenamiento')->nullOnDelete();
            $table->string('titulo')->nullable();
            $table->text('contenido')->nullable();
            $table->unsignedSmallInteger('orden')->default(0);
            $table->timestamps();
        });

        // Alter training_days: drop old unique, add training_id and type
        Schema::table('training_days', function (Blueprint $table) {
            // Add plain index on user_id first so MySQL can use it for the FK after we drop the unique
            $table->index('user_id', 'training_days_user_id_plain');
            $table->dropUnique(['user_id', 'date']);
            $table->foreignId('training_id')->nullable()->after('user_id')->constrained('trainings')->nullOnDelete();
            $table->enum('type', ['personal', 'global'])->default('personal')->after('training_id');
            $table->unique(['user_id', 'date', 'type']);
        });
    }

    public function down(): void
    {
        Schema::table('training_days', function (Blueprint $table) {
            $table->dropUnique(['user_id', 'date', 'type']);
            $table->dropForeign(['training_id']);
            $table->dropColumn(['training_id', 'type']);
            $table->index('user_id', 'training_days_user_id_plain');
            $table->unique(['user_id', 'date']);
            $table->dropIndex('training_days_user_id_plain');
        });
        Schema::dropIfExists('training_plan_nodes');
        Schema::dropIfExists('training_encargados');
        Schema::dropIfExists('trainings');
    }
};
