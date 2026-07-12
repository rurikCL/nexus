<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TrainingPlanNode extends Model
{
    protected $fillable = ['training_id', 'type', 'modulo_id', 'titulo', 'contenido', 'orden', 'es_adicional', 'created_by'];

    protected $casts = [
        'es_adicional' => 'boolean',
    ];

    public function training(): BelongsTo
    {
        return $this->belongsTo(Training::class);
    }

    public function modulo(): BelongsTo
    {
        return $this->belongsTo(ModuloEntrenamiento::class, 'modulo_id');
    }

    public function creador(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
