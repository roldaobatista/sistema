<?php
require __DIR__ . '/vendor/autoload.php';
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;

$email = $argv[1] ?? 'admin@sistema.local';
$password = $argv[2] ?? 'password';

$u = User::where('email', $email)->first();
if (!$u) {
    echo "User not found: $email\n";
    exit(1);
}
$hash = Hash::make($password);
DB::table('users')->where('id', $u->id)->update(['password' => $hash]);
$check = Hash::check($password, DB::table('users')->where('id', $u->id)->value('password'));
echo $check ? "OK - $email / $password\n" : "ERR - hash check failed\n";
