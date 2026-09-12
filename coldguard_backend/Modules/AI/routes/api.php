<?php

use Illuminate\Support\Facades\Route;
use Modules\AI\App\Http\Controllers\AIController;

/*
|--------------------------------------------------------------------------
| AI Integration API Routes
|--------------------------------------------------------------------------
*/

Route::prefix('shipments/{id}')->group(function () {
    Route::post('/ai-analysis', [AIController::class, 'analyze']);
});
