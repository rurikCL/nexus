<?php

declare(strict_types=1);

namespace App\Traits;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Intervention\Image\Drivers\Gd\Driver;
use Intervention\Image\ImageManager;

trait ConvertsToWebp
{
    private function saveAsWebp(UploadedFile $file, string $directory, int $quality = 82): string
    {
        $filename = Str::uuid() . '.webp';
        $fullPath = storage_path("app/public/{$directory}/{$filename}");

        Storage::disk('public')->makeDirectory($directory);

        (new ImageManager(new Driver()))
            ->read($file)
            ->toWebp($quality)
            ->save($fullPath);

        return "{$directory}/{$filename}";
    }

    private function saveContentsAsWebp(string $contents, string $directory, int $quality = 82): string
    {
        $filename = Str::uuid() . '.webp';
        $fullPath = storage_path("app/public/{$directory}/{$filename}");

        Storage::disk('public')->makeDirectory($directory);

        (new ImageManager(new Driver()))
            ->read($contents)
            ->toWebp($quality)
            ->save($fullPath);

        return "{$directory}/{$filename}";
    }
}
