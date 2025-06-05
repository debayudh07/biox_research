// IPFS utility functions for Pinata
interface PinataResponse {
    IpfsHash: string;
    PinSize: number;
    Timestamp: string;
}

export async function uploadToPinata(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);

    const metadata = JSON.stringify({
        name: file.name,
        keyvalues: {
            type: 'research-paper',
            uploadedAt: new Date().toISOString()
        }
    });
    formData.append('pinataMetadata', metadata);

    const options = JSON.stringify({
        cidVersion: 0,
    });
    formData.append('pinataOptions', options);

    try {
        const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: {
                'pinata_api_key': process.env.NEXT_PUBLIC_PINATA_API_KEY!,
                'pinata_secret_api_key': process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY!,
            },
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: PinataResponse = await response.json();
        return result.IpfsHash;
    } catch (error) {
        console.error('Error uploading to IPFS:', error);
        throw error;
    }
}

export async function uploadJSONToPinata(data: any): Promise<string> {
    try {
        const response = await fetch('https://api.pinata.cloud/pinning/pinJSONToIPFS', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'pinata_api_key': process.env.NEXT_PUBLIC_PINATA_API_KEY!,
                'pinata_secret_api_key': process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY!,
            },
            body: JSON.stringify({
                pinataContent: data,
                pinataMetadata: {
                    name: 'research-paper-metadata',
                    keyvalues: {
                        type: 'metadata',
                        uploadedAt: new Date().toISOString()
                    }
                }
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: PinataResponse = await response.json();
        return result.IpfsHash;
    } catch (error) {
        console.error('Error uploading JSON to IPFS:', error);
        throw error;
    }
}
