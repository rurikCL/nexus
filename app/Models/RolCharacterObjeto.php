<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RolCharacterObjeto extends Model
{
    protected $table = 'rol_character_objeto';

    protected $fillable = [
        'character_id',
        'rol_objeto_id',
    ];

    public function character(): BelongsTo
    {
        return $this->belongsTo(Character::class);
    }

    public function rolObjeto(): BelongsTo
    {
        return $this->belongsTo(RolObjeto::class);
    }
}
