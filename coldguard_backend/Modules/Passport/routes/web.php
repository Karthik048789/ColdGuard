<?php

use Illuminate\Support\Facades\Route;
use Modules\Passport\App\Http\Controllers\PassportController;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('passports', PassportController::class)->names('passport');
});
