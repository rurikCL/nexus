<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrainingPlanNode extends Model
{
    protected $fillable = ['training_id', 'type', 'modulo_id', 'titulo', 'contenido', 'orden'];

    public function training(): BelongsTo
    {
        return $this->belongsTo(Training::class);
    }

    public function modulo(): BelongsTo
    {
        return $this->belongsTo(ModuloEntrenamiento::class, 'modulo_id');
    }
}
