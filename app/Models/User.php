<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    protected $hidden = [
        'password',
        'remember_token',
    ];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    public function character(): HasOne
    {
        return $this->hasOne(Character::class);
    }

    public function trainingDays(): HasMany
    {
        return $this->hasMany(TrainingDay::class);
    }

    public function tasksAsTutor(): HasMany
    {
        return $this->hasMany(Task::class, 'tutor_id');
    }

    public function tasksAsPupil(): HasMany
    {
        return $this->hasMany(Task::class, 'pupil_id');
    }

    public function pupils(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'tutor_pupil', 'tutor_id', 'pupil_id');
    }

    public function tutors(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'tutor_pupil', 'pupil_id', 'tutor_id');
    }

    public function events(): BelongsToMany
    {
        return $this->belongsToMany(Event::class, 'event_registrations')
            ->withPivot('claimed')
            ->withTimestamps();
    }

    public function bets(): HasMany
    {
        return $this->hasMany(Bet::class);
    }

    public function challengesAsChallenger(): HasMany
    {
        return $this->hasMany(Challenge::class, 'challenger_id');
    }

    public function challengesAsTarget(): HasMany
    {
        return $this->hasMany(Challenge::class, 'target_id');
    }

    public function isTutor(): bool
    {
        return $this->pupils()->exists();
    }
}
