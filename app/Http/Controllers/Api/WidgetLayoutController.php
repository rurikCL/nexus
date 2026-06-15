<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\WidgetLayout;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WidgetLayoutController extends Controller
{
    public function show(Request $request, string $section): JsonResponse
    {
        $layout = WidgetLayout::where('user_id', $request->user()->id)
            ->where('section', $section)
            ->first();

        return response()->json(['widgets' => $layout?->widgets]);
    }

    public function update(Request $request, string $section): JsonResponse
    {
        $data = $request->validate([
            'widgets'         => 'required|array',
            'widgets.*.id'    => 'required|string',
            'widgets.*.cols'  => 'required|integer|in:1,2',
        ]);

        WidgetLayout::updateOrCreate(
            ['user_id' => $request->user()->id, 'section' => $section],
            ['widgets' => $data['widgets']]
        );

        return response()->json(['ok' => true]);
    }
}
