<?php

use Illuminate\Support\Facades\Route;
use Modules\Blockchain\App\Http\Controllers\BlockchainController;

Route::middleware(['auth', 'verified'])->group(function () {
    Route::resource('blockchains', BlockchainController::class)->names('blockchain');
});
