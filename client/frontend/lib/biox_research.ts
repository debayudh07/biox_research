/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/biox_research.json`.
 */
export type BioxResearch = {
  "address": "4TsLtFAfkbpcFjesanK4ojZNTK1bsQPfPuVxt5g19hhM",
  "metadata": {
    "name": "bioxResearch",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "claimFunds",
      "docs": [
        "Claim funds (only by author when fully funded)"
      ],
      "discriminator": [
        145,
        36,
        143,
        242,
        168,
        66,
        200,
        155
      ],
      "accounts": [
        {
          "name": "author",
          "signer": true
        },
        {
          "name": "paper",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  112,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "paperId"
              }
            ]
          }
        },
        {
          "name": "paperTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  112,
                  101,
                  114,
                  45,
                  116,
                  111,
                  107,
                  101,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "paperId"
              }
            ]
          }
        },
        {
          "name": "authorTokenAccount",
          "writable": true
        },
        {
          "name": "programState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        }
      ],
      "args": [
        {
          "name": "paperId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fundPaper",
      "docs": [
        "Fund a published paper"
      ],
      "discriminator": [
        223,
        208,
        122,
        79,
        221,
        8,
        184,
        180
      ],
      "accounts": [
        {
          "name": "funder",
          "writable": true,
          "signer": true
        },
        {
          "name": "paper",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  112,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "paperId"
              }
            ]
          }
        },
        {
          "name": "funderTokenAccount",
          "writable": true
        },
        {
          "name": "paperTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  112,
                  101,
                  114,
                  45,
                  116,
                  111,
                  107,
                  101,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "paperId"
              }
            ]
          }
        },
        {
          "name": "platformTokenAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  108,
                  97,
                  116,
                  102,
                  111,
                  114,
                  109,
                  45,
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "funding",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  102,
                  117,
                  110,
                  100,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "arg",
                "path": "paperId"
              },
              {
                "kind": "account",
                "path": "funder"
              }
            ]
          }
        },
        {
          "name": "programState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "paperId",
          "type": "u64"
        },
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initialize",
      "docs": [
        "Initialize the program with an admin account"
      ],
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "programState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "publishPaper",
      "docs": [
        "Publish a paper (by author) or approve (by admin)"
      ],
      "discriminator": [
        132,
        116,
        126,
        224,
        32,
        207,
        19,
        18
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true
        },
        {
          "name": "paper",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  112,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "paperId"
              }
            ]
          }
        },
        {
          "name": "programState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "paperId",
          "type": "u64"
        }
      ]
    },
    {
      "name": "submitPaper",
      "docs": [
        "Submit a new research paper"
      ],
      "discriminator": [
        50,
        4,
        72,
        165,
        234,
        253,
        22,
        113
      ],
      "accounts": [
        {
          "name": "author",
          "writable": true,
          "signer": true
        },
        {
          "name": "paper",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  112,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "program_state.paper_count",
                "account": "programState"
              }
            ]
          }
        },
        {
          "name": "programState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "abstractText",
          "type": "string"
        },
        {
          "name": "ipfsHash",
          "type": "string"
        },
        {
          "name": "authors",
          "type": {
            "vec": "string"
          }
        },
        {
          "name": "fundingGoal",
          "type": "u64"
        },
        {
          "name": "fundingPeriodDays",
          "type": "u64"
        }
      ]
    },
    {
      "name": "togglePause",
      "docs": [
        "Emergency pause (admin only)"
      ],
      "discriminator": [
        238,
        237,
        206,
        27,
        255,
        95,
        123,
        229
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "programState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": []
    },
    {
      "name": "updateSettings",
      "docs": [
        "Update platform settings (admin only)"
      ],
      "discriminator": [
        81,
        166,
        51,
        213,
        158,
        84,
        157,
        108
      ],
      "accounts": [
        {
          "name": "admin",
          "signer": true
        },
        {
          "name": "programState",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "platformFeeRate",
          "type": {
            "option": "u16"
          }
        },
        {
          "name": "minFundingGoal",
          "type": {
            "option": "u64"
          }
        }
      ]
    },
    {
      "name": "votePaper",
      "docs": [
        "Vote on a paper (with weighted voting)"
      ],
      "discriminator": [
        227,
        243,
        208,
        52,
        166,
        240,
        1,
        52
      ],
      "accounts": [
        {
          "name": "voter",
          "writable": true,
          "signer": true
        },
        {
          "name": "paper",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  97,
                  112,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "paperId"
              }
            ]
          }
        },
        {
          "name": "programState",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  112,
                  114,
                  111,
                  103,
                  114,
                  97,
                  109,
                  45,
                  115,
                  116,
                  97,
                  116,
                  101
                ]
              }
            ]
          }
        },
        {
          "name": "voterTokenAccount"
        },
        {
          "name": "vote",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  111,
                  116,
                  101
                ]
              },
              {
                "kind": "arg",
                "path": "paperId"
              },
              {
                "kind": "account",
                "path": "voter"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "paperId",
          "type": "u64"
        },
        {
          "name": "isUpvote",
          "type": "bool"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "funding",
      "discriminator": [
        50,
        175,
        214,
        196,
        200,
        110,
        145,
        161
      ]
    },
    {
      "name": "programState",
      "discriminator": [
        77,
        209,
        137,
        229,
        149,
        67,
        167,
        230
      ]
    },
    {
      "name": "researchPaper",
      "discriminator": [
        103,
        125,
        147,
        192,
        213,
        248,
        70,
        245
      ]
    },
    {
      "name": "vote",
      "discriminator": [
        96,
        91,
        104,
        57,
        145,
        35,
        172,
        155
      ]
    }
  ],
  "events": [
    {
      "name": "fundsClaimedEvent",
      "discriminator": [
        214,
        130,
        38,
        93,
        0,
        252,
        245,
        188
      ]
    },
    {
      "name": "paperFundedEvent",
      "discriminator": [
        101,
        161,
        151,
        40,
        4,
        35,
        70,
        86
      ]
    },
    {
      "name": "paperPublishedEvent",
      "discriminator": [
        43,
        91,
        217,
        125,
        104,
        147,
        251,
        7
      ]
    },
    {
      "name": "paperSubmittedEvent",
      "discriminator": [
        239,
        163,
        0,
        214,
        40,
        247,
        34,
        204
      ]
    },
    {
      "name": "paperVotedEvent",
      "discriminator": [
        2,
        167,
        208,
        126,
        167,
        89,
        84,
        231
      ]
    },
    {
      "name": "pauseToggledEvent",
      "discriminator": [
        210,
        185,
        198,
        169,
        200,
        181,
        119,
        167
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidTitle",
      "msg": "Invalid title length"
    },
    {
      "code": 6001,
      "name": "invalidAbstract",
      "msg": "Invalid abstract length"
    },
    {
      "code": 6002,
      "name": "invalidIpfsHash",
      "msg": "Invalid IPFS hash"
    },
    {
      "code": 6003,
      "name": "invalidAuthors",
      "msg": "Invalid authors list"
    },
    {
      "code": 6004,
      "name": "fundingGoalTooLow",
      "msg": "Funding goal too low"
    },
    {
      "code": 6005,
      "name": "invalidFundingPeriod",
      "msg": "Invalid funding period"
    },
    {
      "code": 6006,
      "name": "unauthorized",
      "msg": "Unauthorized action"
    },
    {
      "code": 6007,
      "name": "paperNotPublished",
      "msg": "Paper is not published"
    },
    {
      "code": 6008,
      "name": "fundingDeadlinePassed",
      "msg": "Funding deadline has passed"
    },
    {
      "code": 6009,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6010,
      "name": "invalidPaperStatus",
      "msg": "Invalid paper status"
    },
    {
      "code": 6011,
      "name": "notFullyFunded",
      "msg": "Paper not fully funded"
    },
    {
      "code": 6012,
      "name": "noFundsToClam",
      "msg": "No funds to claim"
    },
    {
      "code": 6013,
      "name": "programPaused",
      "msg": "Program is paused"
    },
    {
      "code": 6014,
      "name": "feeTooHigh",
      "msg": "Fee rate too high"
    }
  ],
  "types": [
    {
      "name": "funding",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paperId",
            "type": "u64"
          },
          {
            "name": "funder",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "platformFee",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "fundsClaimedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paperId",
            "type": "u64"
          },
          {
            "name": "author",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "paperFundedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paperId",
            "type": "u64"
          },
          {
            "name": "funder",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "platformFee",
            "type": "u64"
          },
          {
            "name": "totalFunding",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "paperPublishedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paperId",
            "type": "u64"
          },
          {
            "name": "author",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "paperStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "draft"
          },
          {
            "name": "published"
          },
          {
            "name": "fullyFunded"
          },
          {
            "name": "completed"
          },
          {
            "name": "rejected"
          }
        ]
      }
    },
    {
      "name": "paperSubmittedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paperId",
            "type": "u64"
          },
          {
            "name": "author",
            "type": "pubkey"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "paperVotedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paperId",
            "type": "u64"
          },
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "isUpvote",
            "type": "bool"
          },
          {
            "name": "weight",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "pauseToggledEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "isPaused",
            "type": "bool"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "programState",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "paperCount",
            "type": "u64"
          },
          {
            "name": "totalFunding",
            "type": "u64"
          },
          {
            "name": "platformFeeRate",
            "type": "u16"
          },
          {
            "name": "minFundingGoal",
            "type": "u64"
          },
          {
            "name": "maxFundingPeriod",
            "type": "i64"
          },
          {
            "name": "isPaused",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "researchPaper",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "id",
            "type": "u64"
          },
          {
            "name": "author",
            "type": "pubkey"
          },
          {
            "name": "title",
            "type": "string"
          },
          {
            "name": "abstractText",
            "type": "string"
          },
          {
            "name": "ipfsHash",
            "type": "string"
          },
          {
            "name": "authors",
            "type": {
              "vec": "string"
            }
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "updatedAt",
            "type": "i64"
          },
          {
            "name": "isPublished",
            "type": "bool"
          },
          {
            "name": "fundingGoal",
            "type": "u64"
          },
          {
            "name": "fundingCurrent",
            "type": "u64"
          },
          {
            "name": "fundingDeadline",
            "type": "i64"
          },
          {
            "name": "upvotes",
            "type": "u64"
          },
          {
            "name": "downvotes",
            "type": "u64"
          },
          {
            "name": "status",
            "type": {
              "defined": {
                "name": "paperStatus"
              }
            }
          },
          {
            "name": "reviewScore",
            "type": "u32"
          },
          {
            "name": "reviewCount",
            "type": "u32"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "vote",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "paperId",
            "type": "u64"
          },
          {
            "name": "voter",
            "type": "pubkey"
          },
          {
            "name": "isUpvote",
            "type": "bool"
          },
          {
            "name": "weight",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
