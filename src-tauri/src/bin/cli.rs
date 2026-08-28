use std::env;
use std::process;

fn print_usage() {
    println!("Orbit Download Manager CLI (orbit-cli) v1.1.1");
    println!("Usage: orbit-cli <command> [options]\n");
    println!("Commands:");
    println!("  add <url> [--threads <n>] [--dir <path>]   Add a new URL to download queue");
    println!("  list [--status <status>]                   List active and completed downloads");
    println!("  pause <id>                                 Pause an active download");
    println!("  resume <id>                                Resume a paused download");
    println!("  stats                                      Show network throughput and system stats");
    println!("  version                                    Print version information");
}

fn main() {
    let args: Vec<String> = env::args().collect();
    if args.len() < 2 {
        print_usage();
        process::exit(1);
    }

    match args[1].as_str() {
        "add" => {
            if args.len() < 3 {
                eprintln!("Error: URL required. Example: orbit-cli add https://example.com/file.zip");
                process::exit(1);
            }
            let url = &args[2];
            println!("[+] Queued download for URL: {}", url);
            println!("[+] Dispatching to Orbit Download Engine...");
        }
        "list" => {
            println!("Orbit Active Downloads:");
            println!("ID       STATUS       PROGRESS   SPEED      FILENAME");
            println!("-------- ------------ ---------- ---------- ------------------------");
            println!("No active background daemon connected.");
        }
        "version" | "--version" | "-v" => {
            println!("orbit-cli v1.1.1 (Rust Stable / Tokio / SQLite WAL)");
        }
        "help" | "--help" | "-h" => {
            print_usage();
        }
        cmd => {
            eprintln!("Unknown command: {}", cmd);
            print_usage();
            process::exit(1);
        }
    }
}
