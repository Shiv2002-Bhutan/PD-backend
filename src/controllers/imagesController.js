
export const uploadImage = async (req, res) => {
    if (!req.imagePath) {
        return res.status(400).json({
            success: false,
            message: 'No processed image available.'
        })
    }

    return res.status(201).json({
        url: req.imagePath
    })
}
