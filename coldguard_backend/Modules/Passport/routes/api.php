<?php

use Illuminate\Support\Facades\Route;
use Modules\Passport\App\Http\Controllers\PassportController;

Route::middleware(['auth:sanctum'])->prefix('v1')->group(function () {
    Route::apiResource('passports', PassportController::class)->names('passport');
});
