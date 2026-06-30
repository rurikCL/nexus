<?php

declare(strict_types=1);

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NpcChatLog extends Model
{
    protected $table = 'npc_chat_logs';

    protected $fillable = ['user_id', 'npc_id', 'role', 'content'];

    public function npc(): BelongsTo
    {
        return $this->belongsTo(MapNpc::class, 'npc_id');
    }
}
